output "cnapp_role_arn" {
  value = aws_iam_role.cnapp_readonly.arn
}

output "rotation_role_arn" {
  value = try(aws_iam_role.rotation_optional[0].arn, null)
}