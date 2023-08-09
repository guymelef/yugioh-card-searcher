const wakeUpDyno = (url, minutes = 13) => {
  const milliseconds = minutes * 60000
  
  setTimeout(() => {
    try {
      console.log(`⏰ Keeping app awake...`)
      fetch(url)
      .then(() => console.log(`🏠 Fetching homepage...`))
      .catch(err => console.log("ERROR: Could not refresh app!", err))
    } catch (err) {
      console.log(`ERROR: Fetch failed due to: [[ ${err.message} ]] \nWill retry in ${minutes} minutes...`)
    } finally {
      return wakeUpDyno(url, minutes)
    }
  }, milliseconds)
}





module.exports = wakeUpDyno