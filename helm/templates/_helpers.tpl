{{/*
Expand the name of the chart.
*/}}
{{- define "weasley-clock.name" -}}
{{- .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "weasley-clock.fullname" -}}
{{- printf "%s" .Release.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "weasley-clock.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Backend image reference
*/}}
{{- define "weasley-clock.backendImage" -}}
{{ .Values.imageRegistry }}/{{ .Values.backend.image }}:{{ .Values.imageTag }}
{{- end }}

{{/*
Frontend image reference
*/}}
{{- define "weasley-clock.frontendImage" -}}
{{ .Values.imageRegistry }}/{{ .Values.frontend.image }}:{{ .Values.imageTag }}
{{- end }}
