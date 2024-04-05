FROM alpine:latest

RUN apk update && \
    apk upgrade && \
    apk add --no-cache build-base musl-dev go git
RUN CGO_ENABLED=1 go install -tags extended github.com/gohugoio/hugo@latest && \
    echo 'export PATH="$PATH:$HOME/go/bin"' >> /etc/profile

CMD ["/bin/sh", "-c", "while true; do sleep 30; done;"]
