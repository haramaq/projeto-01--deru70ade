migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const email = 'elisandrodesousaharamaq@gmail.com'
    let admin

    try {
      admin = app.findAuthRecordByEmail('_pb_users_auth_', email)
    } catch (_) {
      admin = new Record(users)
      admin.setEmail(email)
      admin.setPassword('Skip@Pass')
      admin.set('name', 'Elisandro de Sousa')
    }

    admin.setEmail(email)
    admin.setPassword('Skip@Pass')
    admin.set('name', 'Elisandro de Sousa')
    admin.set('role', 'admin')
    admin.set('ativo', true)
    admin.set('carteira', '')
    admin.setVerified(true)
    app.save(admin)
  },
  (app) => {
    // Keep the administrative account on rollback; removing it would lock the project.
  },
)
