migrate(
  (app) => {
    const password =
      $secrets.get('HARAMAQ_ADMIN_BOOTSTRAP_PASSWORD') ||
      $os.getenv('HARAMAQ_ADMIN_BOOTSTRAP_PASSWORD')
    if (!password || password.length < 12) {
      throw new Error('HARAMAQ_ADMIN_BOOTSTRAP_PASSWORD must contain at least 12 characters')
    }

    const admin = app.findAuthRecordByEmail('_pb_users_auth_', 'elisandrodesousaharamaq@gmail.com')
    admin.setPassword(password)
    admin.setVerified(true)
    app.save(admin)
  },
  (app) => {
    // Password rotation is intentionally not reversible.
  },
)
