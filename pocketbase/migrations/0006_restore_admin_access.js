migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const email = 'elisandrodesousaharamaq@gmail.com'
    let admin

    try {
      admin = app.findAuthRecordByEmail('_pb_users_auth_', email)
    } catch (_) {
      const bootstrapPassword = $os.getenv('HARAMAQ_ADMIN_BOOTSTRAP_PASSWORD')
      if (!bootstrapPassword || bootstrapPassword.length < 12) {
        throw new Error('HARAMAQ_ADMIN_BOOTSTRAP_PASSWORD must be configured with at least 12 characters')
      }
      admin = new Record(users)
      admin.setEmail(email)
      admin.setPassword(bootstrapPassword)
      admin.set('name', 'Elisandro de Sousa')
    }

    admin.setEmail(email)
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
