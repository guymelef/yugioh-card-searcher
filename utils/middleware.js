const { SECRET_KEY } = require('./config')



const checkRequestKeyHeader = (req, res, next) => {
  const requestKey = req.header('X-Request-Key')

  if (requestKey === SECRET_KEY) next()
  else res.status(403).end()
}





module.exports = { checkRequestKeyHeader }