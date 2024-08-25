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

func serveIndexHTML(devMode bool, manifest map[string]interface{}, pathPrefix string, files http.FileSystem) (http.HandlerFunc, error) {
	rawIndex, err := files.Open("index.html")
	if err != nil {
		return nil, fmt.Errorf("index.html not found in embedded files: %w", err)
	}

	config := struct {
		APIURL string `json:"apiUrl"`
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
		return nil, fmt.Errorf("could not stat index.html: %w", err)
	}

	indexBuf, err := io.ReadAll(rawIndex)
	if err != nil {
		return nil, fmt.Errorf("could not read index.html: %w", err)
	}

	tmpl, err := template.New("index.html").Funcs(template.FuncMap{
		"marshal": func(v interface{}) template.JS {
			a, _ := json.Marshal(v)
			return template.JS(a)
		},
	}).Parse(string(indexBuf))
	if err != nil {
		return nil, fmt.Errorf("could not parse index.html: %w", err)
	}

	var output bytes.Buffer
	if err = tmpl.Execute(&output, templateData); err != nil {
		return nil, fmt.Errorf("could not execute index.html: %w", err)
	}

	index := bytes.NewReader(output.Bytes())

	return func(rw http.ResponseWriter, req *http.Request) {
		// Restrict only to instances where the browser is looking for an HTML file
		if !strings.Contains(req.Header.Get("Accept"), "text/html") {
			rw.WriteHeader(http.StatusNotFound)
			fmt.Fprint(rw, "404 not found")

			return
		}

		rw.Header().Set("Content-Type", "text/html; charset=utf-8")
		http.ServeContent(rw, req, fileInfo.Name(), fileInfo.ModTime(), index)
	}, nil
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
