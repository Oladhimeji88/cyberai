package authz

default allow = false

role_perms := {
  "OWNER": ["*"],
  "ADMIN": ["*"],
  "SECURITY": ["read:secret", "rotate:secret", "read:alert", "respond:alert", "read:pam_request", "approve:pam_request", "read:pam_session", "scan:cnapp", "read:finding", "read:dashboard", "read:audit"],
  "DEVOPS": ["read:secret", "create:pam_request", "start:pam_session", "update:pam_session", "scan:cnapp", "read:finding", "read:dashboard"],
  "AUDITOR": ["read:alert", "read:audit", "read:pam_session", "read:secret", "read:dashboard"],
  "REQUESTER": ["create:pam_request", "read:pam_request", "read:dashboard"]
}

allow {
  role := input.user.role
  perms := role_perms[role]
  perms[_] == "*"
}

allow {
  role := input.user.role
  perms := role_perms[role]
  action := sprintf("%s:%s", [input.action, input.resource])
  perms[_] == action
}
