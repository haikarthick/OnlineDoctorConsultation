# ═══════════════════════════════════════════════════════════════
#  VetCare Platform - Terraform Infrastructure (AWS)
#  Provisions: VPC, RDS, ElastiCache, ECS Fargate, ALB, ACM, S3
# ═══════════════════════════════════════════════════════════════

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state - uncomment and configure for your team
  # backend "s3" {
  #   bucket         = "vetcare-terraform-state"
  #   key            = "prod/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "vetcare-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "VetCare"
      ManagedBy   = "Terraform"
      Environment = var.environment
    }
  }
}

# ─── Variables ────────────────────────────────────────────────

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (prod, staging)"
  type        = string
  default     = "prod"
}

variable "domain_name" {
  description = "Public domain name for the application"
  type        = string
}

variable "db_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT signing secret"
  type        = string
  sensitive   = true
}

variable "redis_password" {
  description = "Redis AUTH token"
  type        = string
  sensitive   = true
}

variable "docker_registry" {
  description = "Docker image registry prefix"
  type        = string
  default     = "ghcr.io/your-org/vetcare"
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

# ─── Data Sources ─────────────────────────────────────────────

data "aws_availability_zones" "available" {
  state = "available"
}

# ─── VPC ──────────────────────────────────────────────────────

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "vetcare-${var.environment}-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "vetcare-${var.environment}-igw" }
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "vetcare-${var.environment}-public-${count.index + 1}" }
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = { Name = "vetcare-${var.environment}-private-${count.index + 1}" }
}

resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = { Name = "vetcare-${var.environment}-nat-eip" }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  tags          = { Name = "vetcare-${var.environment}-nat" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = { Name = "vetcare-${var.environment}-public-rt" }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }
  tags = { Name = "vetcare-${var.environment}-private-rt" }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# ─── Security Groups ─────────────────────────────────────────

resource "aws_security_group" "alb" {
  name_prefix = "vetcare-alb-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "vetcare-${var.environment}-alb-sg" }
}

resource "aws_security_group" "backend" {
  name_prefix = "vetcare-backend-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "vetcare-${var.environment}-backend-sg" }
}

resource "aws_security_group" "database" {
  name_prefix = "vetcare-db-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.backend.id]
  }
  tags = { Name = "vetcare-${var.environment}-db-sg" }
}

resource "aws_security_group" "redis" {
  name_prefix = "vetcare-redis-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.backend.id]
  }
  tags = { Name = "vetcare-${var.environment}-redis-sg" }
}

# ─── RDS (PostgreSQL) ────────────────────────────────────────

resource "aws_db_subnet_group" "main" {
  name       = "vetcare-${var.environment}"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "vetcare-${var.environment}-db-subnet" }
}

resource "aws_db_instance" "postgres" {
  identifier     = "vetcare-${var.environment}"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.t3.medium"

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "veterinary_consultation"
  username = "vetcare_app"
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.database.id]

  multi_az                  = true
  backup_retention_period   = 7
  backup_window             = "03:00-04:00"
  maintenance_window        = "Mon:04:00-Mon:05:00"
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "vetcare-${var.environment}-final"

  performance_insights_enabled = true

  tags = { Name = "vetcare-${var.environment}-postgres" }
}

# ─── ElastiCache (Redis) ─────────────────────────────────────

resource "aws_elasticache_subnet_group" "main" {
  name       = "vetcare-${var.environment}"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "vetcare-${var.environment}"
  description          = "VetCare Redis cache"
  node_type            = "cache.t3.micro"
  num_cache_clusters   = 2
  engine_version       = "7.0"

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.redis_password

  automatic_failover_enabled = true

  tags = { Name = "vetcare-${var.environment}-redis" }
}

# ─── ACM Certificate ─────────────────────────────────────────

resource "aws_acm_certificate" "main" {
  domain_name       = var.domain_name
  validation_method = "DNS"

  subject_alternative_names = ["*.${var.domain_name}"]

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "vetcare-${var.environment}-cert" }
}

# ─── Application Load Balancer ───────────────────────────────

resource "aws_lb" "main" {
  name               = "vetcare-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = true

  tags = { Name = "vetcare-${var.environment}-alb" }
}

resource "aws_lb_target_group" "backend" {
  name        = "vetcare-${var.environment}-backend"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/api/v1/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  tags = { Name = "vetcare-${var.environment}-backend-tg" }
}

resource "aws_lb_target_group" "frontend" {
  name        = "vetcare-${var.environment}-frontend"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  tags = { Name = "vetcare-${var.environment}-frontend-tg" }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.main.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/api/*", "/ws", "/uploads/*"]
    }
  }
}

# ─── ECS Cluster (Fargate) ───────────────────────────────────

resource "aws_ecs_cluster" "main" {
  name = "vetcare-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = { Name = "vetcare-${var.environment}-cluster" }
}

resource "aws_iam_role" "ecs_task_execution" {
  name = "vetcare-${var.environment}-ecs-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/vetcare-${var.environment}-backend"
  retention_in_days = 30
  tags              = { Name = "vetcare-${var.environment}-backend-logs" }
}

resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/vetcare-${var.environment}-frontend"
  retention_in_days = 14
  tags              = { Name = "vetcare-${var.environment}-frontend-logs" }
}

# ─── ECS Task Definitions ────────────────────────────────────

resource "aws_ecs_task_definition" "backend" {
  family                   = "vetcare-${var.environment}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([{
    name      = "backend"
    image     = "${var.docker_registry}/backend:${var.image_tag}"
    essential = true
    portMappings = [{ containerPort = 3000, protocol = "tcp" }]

    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = "3000" },
      { name = "DB_HOST", value = aws_db_instance.postgres.address },
      { name = "DB_PORT", value = "5432" },
      { name = "DB_USER", value = "vetcare_app" },
      { name = "DB_NAME", value = "veterinary_consultation" },
      { name = "DB_POOL_MIN", value = "5" },
      { name = "DB_POOL_MAX", value = "30" },
      { name = "DB_SSL", value = "true" },
      { name = "REDIS_HOST", value = aws_elasticache_replication_group.redis.primary_endpoint_address },
      { name = "REDIS_PORT", value = "6379" },
      { name = "CORS_ORIGIN", value = "https://${var.domain_name}" },
      { name = "CORS_CREDENTIALS", value = "true" },
      { name = "LOG_LEVEL", value = "warn" },
      { name = "FEATURE_REDIS_CACHE", value = "true" },
      { name = "FEATURE_AUDIT_LOGGING", value = "true" },
      { name = "FEATURE_REALTIME_CHAT", value = "true" },
      { name = "FEATURE_ADVANCED_RATE_LIMITING", value = "true" },
    ]

    secrets = [
      { name = "DB_PASSWORD", valueFrom = aws_ssm_parameter.db_password.arn },
      { name = "JWT_SECRET", valueFrom = aws_ssm_parameter.jwt_secret.arn },
      { name = "REDIS_PASSWORD", valueFrom = aws_ssm_parameter.redis_password.arn },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.backend.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "backend"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 40
    }
  }])

  tags = { Name = "vetcare-${var.environment}-backend-task" }
}

resource "aws_ecs_task_definition" "frontend" {
  family                   = "vetcare-${var.environment}-frontend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([{
    name      = "frontend"
    image     = "${var.docker_registry}/frontend:${var.image_tag}"
    essential = true
    portMappings = [{ containerPort = 80, protocol = "tcp" }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.frontend.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "frontend"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 10
    }
  }])

  tags = { Name = "vetcare-${var.environment}-frontend-task" }
}

# ─── ECS Services ────────────────────────────────────────────

resource "aws_ecs_service" "backend" {
  name            = "vetcare-${var.environment}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.backend.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 3000
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  tags = { Name = "vetcare-${var.environment}-backend-svc" }
}

resource "aws_ecs_service" "frontend" {
  name            = "vetcare-${var.environment}-frontend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.alb.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = 80
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  tags = { Name = "vetcare-${var.environment}-frontend-svc" }
}

# ─── Auto Scaling ─────────────────────────────────────────────

resource "aws_appautoscaling_target" "backend" {
  max_capacity       = 6
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "backend_cpu" {
  name               = "vetcare-${var.environment}-backend-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
  }
}

# ─── SSM Parameters (secrets) ────────────────────────────────

resource "aws_ssm_parameter" "db_password" {
  name  = "/vetcare/${var.environment}/db-password"
  type  = "SecureString"
  value = var.db_password
  tags  = { Name = "vetcare-${var.environment}-db-password" }
}

resource "aws_ssm_parameter" "jwt_secret" {
  name  = "/vetcare/${var.environment}/jwt-secret"
  type  = "SecureString"
  value = var.jwt_secret
  tags  = { Name = "vetcare-${var.environment}-jwt-secret" }
}

resource "aws_ssm_parameter" "redis_password" {
  name  = "/vetcare/${var.environment}/redis-password"
  type  = "SecureString"
  value = var.redis_password
  tags  = { Name = "vetcare-${var.environment}-redis-password" }
}

# ─── S3 Bucket (file uploads) ────────────────────────────────

resource "aws_s3_bucket" "uploads" {
  bucket = "vetcare-${var.environment}-uploads"
  tags   = { Name = "vetcare-${var.environment}-uploads" }
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─── Outputs ──────────────────────────────────────────────────

output "alb_dns_name" {
  description = "ALB DNS name - point your domain CNAME here"
  value       = aws_lb.main.dns_name
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.postgres.endpoint
}

output "redis_endpoint" {
  description = "ElastiCache Redis primary endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "s3_uploads_bucket" {
  description = "S3 bucket for file uploads"
  value       = aws_s3_bucket.uploads.id
}

output "ecs_cluster" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}
