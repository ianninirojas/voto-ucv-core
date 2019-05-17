const prod = {
  host: 'smtp.gmail.com',
  secure: true,
  port: 465,
  auth: {
    user: 'voto.ucv@gmail.com',
    pass: 'koko151215'
  }
}

const dev = {
  host: 'smtp.gmail.com',
  secure: true,
  port: 465,
  auth: {
    user: 'voto.ucv@gmail.com',
    pass: 'koko151215'
  }
}

export const emailConfig = process.env.REACT_APP_ENV === "production" ? prod : dev;