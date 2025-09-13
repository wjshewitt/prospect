# Use a Miniconda image as a base for easier management of geospatial libraries
FROM continuumio/miniconda3

# Set the working directory in the container
WORKDIR /app

# Install Python dependencies using conda
# geopandas, shapely, requests, flask for HTTP service
RUN conda install -c conda-forge geopandas shapely requests flask -y && \
    conda clean --all

# Copy the application script into the container
COPY src/app/api/uk-geoai/flood/local-flood.py .

# Define the command to run the script
EXPOSE 5000
CMD ["python", "local-flood.py"]