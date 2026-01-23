package riverui

import (
	"bytes"
	"encoding/json"
	"html/template"
	"io"
	"mime"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"
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

func serveIndexHTML(devMode bool, manifest map[string]any, pathPrefix string, files http.FileSystem) http.HandlerFunc {
	cachedIndex := indexTemplateResult{}
	if !devMode {
		cachedIndex = loadIndexTemplate(files)
	}

	return func(rw http.ResponseWriter, req *http.Request) {
		if req.Method != http.MethodGet && req.Method != http.MethodHead {
			rw.Header().Set("Allow", "GET, HEAD")
			http.Error(rw, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		addVaryHeader(rw.Header(), "Accept")

		// Restrict only to instances where the browser is looking for an HTML file
		if !acceptsHTML(req) {
			http.Error(rw, "not acceptable: only text/html is available", http.StatusNotAcceptable)
			return
		}

		indexTemplate := cachedIndex
		if devMode {
			indexTemplate = loadIndexTemplate(files)
		}
		if indexTemplate.err != nil {
			http.Error(rw, indexTemplate.errMessage, http.StatusInternalServerError)
			return
		}

		config := indexTemplateConfig{
			APIURL: pathPrefix + "/api",
			Base:   pathPrefix,
		}

		templateData := indexTemplateData{
			Config:   config,
			Dev:      devMode,
			Manifest: manifest,
			Base:     pathPrefix,
		}

		var output bytes.Buffer
		if err := indexTemplate.tmpl.Execute(&output, templateData); err != nil {
			http.Error(rw, "could not execute index.html", http.StatusInternalServerError)
			return
		}

		indexReader := bytes.NewReader(output.Bytes())

		rw.Header().Set("Content-Type", "text/html; charset=utf-8")
		http.ServeContent(rw, req, indexTemplate.name, indexTemplate.modTime, indexReader)
	}
}

func acceptsHTML(req *http.Request) bool {
	acceptValues := req.Header.Values("Accept")
	if len(acceptValues) == 0 {
		return true
	}

	return slices.ContainsFunc(acceptValues, acceptsHTMLValue)
}

func acceptsHTMLValue(accept string) bool {
	if strings.TrimSpace(accept) == "" {
		return true
	}

	for part := range strings.SplitSeq(accept, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}

		mediaType, params, err := mime.ParseMediaType(part)
		if err != nil {
			mediaType = strings.TrimSpace(strings.SplitN(part, ";", 2)[0])
			params = nil
		}

		quality := 1.0
		if params != nil {
			if qRaw, ok := params["q"]; ok {
				if parsed, err := strconv.ParseFloat(qRaw, 64); err == nil {
					quality = parsed
				}
			}
		}

		if quality <= 0 {
			continue
		}

		switch mediaType {
		case "text/html", "application/xhtml+xml", "text/*", "*/*":
			return true
		}
	}

	return false
}

func addVaryHeader(headers http.Header, value string) {
	for _, existing := range headers.Values("Vary") {
		for part := range strings.SplitSeq(existing, ",") {
			if strings.EqualFold(strings.TrimSpace(part), value) {
				return
			}
		}
	}

	headers.Add("Vary", value)
}

type indexTemplateConfig struct {
	APIURL string `json:"apiUrl"` //nolint:tagliatelle
	Base   string `json:"base"`
}

type indexTemplateData struct {
	Config   indexTemplateConfig
	Dev      bool
	Manifest map[string]any
	Base     string
}

type indexTemplateResult struct {
	tmpl       *template.Template
	name       string
	modTime    time.Time
	err        error
	errMessage string
}

func loadIndexTemplate(files http.FileSystem) indexTemplateResult {
	rawIndex, err := files.Open("index.html")
	if err != nil {
		return indexTemplateResult{err: err, errMessage: "could not open index.html"}
	}
	defer rawIndex.Close()

	fileInfo, err := rawIndex.Stat()
	if err != nil {
		return indexTemplateResult{err: err, errMessage: "could not stat index.html"}
	}

	indexBuf, err := io.ReadAll(rawIndex)
	if err != nil {
		return indexTemplateResult{err: err, errMessage: "could not read index.html"}
	}

	tmpl, err := parseIndexTemplate(indexBuf)
	if err != nil {
		return indexTemplateResult{err: err, errMessage: "could not parse index.html"}
	}

	return indexTemplateResult{
		tmpl:    tmpl,
		name:    fileInfo.Name(),
		modTime: fileInfo.ModTime(),
	}
}

func parseIndexTemplate(indexBuf []byte) (*template.Template, error) {
	return template.New("index.html").Funcs(template.FuncMap{
		"marshal": func(v any) (template.JS, error) {
			payload, err := json.Marshal(v)
			if err != nil {
				return "", err
			}
			return template.JS(payload), nil //nolint:gosec
		},
	}).Parse(string(indexBuf))
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
