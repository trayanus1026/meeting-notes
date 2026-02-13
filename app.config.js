module.exports = {
  ...require('./app.json'),
  extra: {
    // EAS project ID for push (set in eas.json or env)
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    },
  },
};
