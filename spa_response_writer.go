package riverui

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"strings"
)

func intercept404(handler, on404 http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			// pre-emptively intercept the root path and serve the dynamically processed index.html:
			on404.ServeHTTP(w, r)
			return
		}

		hookedWriter := &spaResponseWriter{ResponseWriter: w}
		handler.ServeHTTP(hookedWriter, r)

		if hookedWriter.got404 {
			on404.ServeHTTP(w, r)
		}
	})
}

func serveIndexHTML(devMode bool, manifest map[string]interface{}, pathPrefix string, files http.FileSystem) http.HandlerFunc {
	return func(rw http.ResponseWriter, req *http.Request) {
		// Restrict only to instances where the browser is looking for an HTML file
		if !strings.Contains(req.Header.Get("Accept"), "text/html") {
			rw.WriteHeader(http.StatusNotFound)
			fmt.Fprint(rw, "404 not found")

			return
		}

		rawIndex, err := files.Open("index.html")
		if err != nil {
			http.Error(rw, "could not open index.html", http.StatusInternalServerError)
			return
		}

		config := struct {
			APIURL string `json:"apiUrl"` //nolint:tagliatelle
			Base   string `json:"base"`
		}{
			APIURL: pathPrefix + "/api",
			Base:   pathPrefix,
		}

		templateData := map[string]interface{}{
			"Config":   config,
			"Dev":      devMode,
			"Manifest": manifest,
			"Base":     pathPrefix,
		}

		fileInfo, err := rawIndex.Stat()
		if err != nil {
			http.Error(rw, "could not stat index.html", http.StatusInternalServerError)
			return
		}

		indexBuf, err := io.ReadAll(rawIndex)
		if err != nil {
			http.Error(rw, "could not read index.html", http.StatusInternalServerError)
			return
		}

		tmpl, err := template.New("index.html").Funcs(template.FuncMap{
			"marshal": func(v interface{}) template.JS {
				a, _ := json.Marshal(v)
				return template.JS(a) //nolint:gosec
			},
		}).Parse(string(indexBuf))
		if err != nil {
			http.Error(rw, "could not parse index.html", http.StatusInternalServerError)
			return
		}

		var output bytes.Buffer
		if err = tmpl.Execute(&output, templateData); err != nil {
			http.Error(rw, "could not execute index.html", http.StatusInternalServerError)
			return
		}

		index := bytes.NewReader(output.Bytes())

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
