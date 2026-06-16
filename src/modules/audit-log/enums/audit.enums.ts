export enum AuditCategory {
  AUTH = 'AUTH',
  RESOURCE = 'RESOURCE',
  TRANSACTION = 'TRANSACTION',
  PAYMENT = 'PAYMENT',
  COMMUNICATION = 'COMMUNICATION',
  ADMIN = 'ADMIN',
  SYSTEM = 'SYSTEM',
}

export enum AuditAction {
  // Auth domain
  AUTH_LOGIN = 'auth.login',
  AUTH_LOGOUT = 'auth.logout',
  AUTH_REGISTER = 'auth.register',
  AUTH_REFRESH = 'auth.refresh',
  AUTH_PASSWORD_RESET = 'auth.password_reset',
  AUTH_PASSWORD_CHANGE = 'auth.password_change',
  AUTH_OTP_SEND = 'auth.otp_send',
  AUTH_OTP_VERIFY = 'auth.otp_verify',

  // Resource domain
  RESOURCE_CREATE = 'resource.create',
  RESOURCE_READ = 'resource.read',
  RESOURCE_UPDATE = 'resource.update',
  RESOURCE_DELETE = 'resource.delete',

  // Transaction domain
  TRANSACTION_CREATE = 'transaction.create',
  TRANSACTION_UPDATE = 'transaction.update',
  TRANSACTION_CANCEL = 'transaction.cancel',

  // Payment domain
  PAYMENT_INITIATE = 'payment.initiate',
  PAYMENT_SUCCESS = 'payment.success',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_REFUND = 'payment.refund',

  // Communication domain
  COMMUNICATION_SEND = 'communication.send',
  COMMUNICATION_READ = 'communication.read',

  // Admin domain
  ADMIN_VIEW = 'admin.view',
  ADMIN_UPDATE = 'admin.update',
  ADMIN_DELETE = 'admin.delete',
  ADMIN_ASSIGN = 'admin.assign',
  ADMIN_EXPORT = 'admin.export',

  // System domain
  SYSTEM_ERROR = 'system.error',
  SYSTEM_CONFIG_CHANGE = 'system.config_change',

  // Certificate domain
  CERTIFICATE_CREATE = 'certificate.create',
  CERTIFICATE_UPDATE = 'certificate.update',
  CERTIFICATE_BLOCK = 'certificate.block',
  CERTIFICATE_UNLOCK = 'certificate.unlock',

  // Assessment domain
  ASSESSMENT_CREATE = 'assessment.create',
  ASSESSMENT_SUBMIT = 'assessment.submit',
  ASSESSMENT_REVIEW = 'assessment.review',
  ASSESSMENT_APPROVE = 'assessment.approve',
  ASSESSMENT_REJECT = 'assessment.reject',

  // Employee domain
  EMPLOYEE_CREATE = 'employee.create',
  EMPLOYEE_UPDATE = 'employee.update',
  EMPLOYEE_DELETE = 'employee.delete',
}
