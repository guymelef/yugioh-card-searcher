const checkRequestKeyHeader = (req, res, next) => {
  const requestKey = req.header('X-Request-Key')
  const expectedKey = process.env.SECRET_KEY

  if (requestKey === expectedKey) next()
  else res.status(403).end()
}





module.exports = { checkRequestKeyHeader }