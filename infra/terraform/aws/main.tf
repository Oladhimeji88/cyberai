terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

data "aws_iam_policy_document" "trust" {
  statement {
    effect = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "AWS"
      identifiers = [var.trusted_principal_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "sts:ExternalId"
      values   = [var.external_id]
    }
  }
}

resource "aws_iam_role" "cnapp_readonly" {
  name               = "sentinel-cnapp-readonly"
  assume_role_policy = data.aws_iam_policy_document.trust.json
}

resource "aws_iam_role_policy" "cnapp_readonly" {
  name = "sentinel-cnapp-readonly"
  role = aws_iam_role.cnapp_readonly.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:ListAllMyBuckets",
          "s3:GetBucketAcl",
          "ec2:DescribeSecurityGroups",
          "iam:ListUsers",
          "iam:ListAccessKeys",
          "iam:GetAccountSummary",
          "cloudtrail:DescribeTrails"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role" "rotation_optional" {
  count              = var.enable_rotation_role ? 1 : 0
  name               = "sentinel-rotation-optional"
  assume_role_policy = data.aws_iam_policy_document.trust.json
}

resource "aws_iam_role_policy" "rotation_optional" {
  count = var.enable_rotation_role ? 1 : 0
  name  = "sentinel-rotation-optional"
  role  = aws_iam_role.rotation_optional[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "iam:CreateAccessKey",
          "iam:DeleteAccessKey",
          "iam:UpdateAccessKey",
          "iam:ListAccessKeys"
        ]
        Resource = "arn:aws:iam::*:user/${var.rotation_user_name}"
      }
    ]
  })
}