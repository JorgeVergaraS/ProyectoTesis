FROM python:3.13.7-alpine3.22
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && addgroup -S nexo && adduser -S nexo -G nexo
COPY bridge.py .
USER nexo
ENTRYPOINT ["python", "bridge.py"]
