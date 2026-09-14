migrate(
  (app) => {
    // Keep user data private: only administrators/managers can list users;
    // any authenticated user may read their own record for session refresh.
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')"
    users.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || id = @request.auth.id)"
    users.createRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    users.updateRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    users.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    app.save(users)
  },
  (app) => {
    // Preserve the stricter user visibility on rollback.
  },
)
