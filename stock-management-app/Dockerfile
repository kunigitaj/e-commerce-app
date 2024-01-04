# Dockerfile

# Use an official Go runtime as a parent image
FROM golang:1.21.5

# Set the working directory inside the container
WORKDIR /app

# Copy go.mod and go.sum if using Go Modules
COPY go.mod go.sum ./

# Download all dependencies
RUN go mod download

# Copy the local package files to the container's workspace
COPY . .

# Build the Go app
RUN go build -o /app/main

# Make port 8080 available to the world outside this container
EXPOSE 8080

# Run the app when the container launches
CMD ["/app/main"]
