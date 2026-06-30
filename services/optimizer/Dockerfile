# syntax=docker/dockerfile:1
FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml ./
COPY optimizer ./optimizer
RUN pip install --no-cache-dir .
EXPOSE 8000
CMD ["uvicorn", "optimizer.main:app", "--host", "0.0.0.0", "--port", "8000"]
