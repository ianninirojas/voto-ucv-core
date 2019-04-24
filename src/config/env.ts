const prod = {
  apiNemUrl: "http://54.178.241.129:3000"
}

const dev = {
  apiNemUrl: "http://54.178.241.129:3000"
}

export const env = process.env.REACT_APP_ENV === "production" ? prod : dev;