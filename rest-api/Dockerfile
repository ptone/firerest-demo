FROM tiangolo/uvicorn-gunicorn:python3.7
ENV PORT=8080
EXPOSE 8080
COPY requirements.txt /requirements.txt
RUN pip install -r /requirements.txt
COPY ./ /app/
