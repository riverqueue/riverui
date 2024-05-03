package main

import (
	"fmt"
	"net/http"
	"strings"
)

func intercept404(handler, on404 http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hookedWriter := &spaResponseWriter{ResponseWriter: w}
		handler.ServeHTTP(hookedWriter, r)

		if hookedWriter.got404 {
			on404.ServeHTTP(w, r)
		}
	})
}

func serveFileContents(file string, files http.FileSystem) http.HandlerFunc {
	return func(rw http.ResponseWriter, req *http.Request) {
		// Restrict only to instances where the browser is looking for an HTML file
		if !strings.Contains(req.Header.Get("Accept"), "text/html") {
			rw.WriteHeader(http.StatusNotFound)
			fmt.Fprint(rw, "404 not found")

			return
		}

		// Open the file and return its contents using http.ServeContent
		index, err := files.Open(file)
		if err != nil {
			rw.WriteHeader(http.StatusNotFound)
			fmt.Fprintf(rw, "%s not found", file)

			return
		}

		fileInfo, err := index.Stat()
		if err != nil {
			rw.WriteHeader(http.StatusNotFound)
			fmt.Fprintf(rw, "%s not found", file)

			return
		}

		rw.Header().Set("Content-Type", "text/html; charset=utf-8")
		http.ServeContent(rw, req, fileInfo.Name(), fileInfo.ModTime(), index)
	}
}

type spaResponseWriter struct {
	http.ResponseWriter
	got404 bool
}

func (srw *spaResponseWriter) WriteHeader(status int) {
	if status == http.StatusNotFound {
		// Don't actually write the 404 header, just set a flag.
		srw.got404 = true
	} else {
		srw.ResponseWriter.WriteHeader(status)
	}
}

func (srw *spaResponseWriter) Write(payload []byte) (int, error) {
	if srw.got404 {
		// No-op, but pretend that we wrote len(p) bytes to the writer.
		return len(payload), nil
	}

	return srw.ResponseWriter.Write(payload)
}
