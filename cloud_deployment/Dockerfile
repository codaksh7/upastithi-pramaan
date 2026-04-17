# Use an official Python runtime with slim debian as a parent image
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Install critical system dependencies for computer vision and C++ compiling (dlib)
# We must include cmake and g++ to compile the dlib wheel in the cloud
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Copy only the isolated cloud requirements first to leverage Docker cache
COPY cloud_deployment/requirements.txt .

# Force the C++ compiler to use only 1 thread. 
# By default, Render tries to use all 8+ cloud CPUs to compile dlib, hitting 8GB+ of memory and crashing.
ENV CMAKE_BUILD_PARALLEL_LEVEL=1

# Install Python dependencies specifically tuned for cloud
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Now copy the backend directory into the container
# By setting context as the root repo folder, 'backend' is copied cleanly
COPY backend/ /app/

# Expose port 8000 for FastAPI
EXPOSE 8000

# Run the FastAPI server in production mode
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
