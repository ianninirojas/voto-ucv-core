const prod = {
  jwtSecret: "@QEGTUI"
}

const dev = {
  jwtSecret: "@QEGTUI"
}

export const secrets = process.env.REACT_APP_ENV === "production" ? prod : dev;