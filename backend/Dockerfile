FROM public.ecr.aws/lambda/python:3.12

# Copy dependency list and install
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install --no-cache-dir -r requirements.txt

# Copy all backend source files into task root
COPY . ${LAMBDA_TASK_ROOT}

# AWS Lambda handler command executed via Mangum adapter
CMD ["main.handler"]