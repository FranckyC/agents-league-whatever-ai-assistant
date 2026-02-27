@export()
type RBACPrincipalType = {
  principalId: string
  principalType: 'User' | 'ServicePrincipal' | 'Group'
}

@export()
type UserLoginInfo = {
  login: string
  principalId: string
}
