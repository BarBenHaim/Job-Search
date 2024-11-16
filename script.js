const puppeteer = require('puppeteer')
const nodemailer = require('nodemailer')
const fs = require('fs')

// Helper function for delays
function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time))
}
// einy.maya@gmail.com
// Function to generate the date string for 30 days ago
function getLast30DaysDate() {
    const today = new Date()
    const pastDate = new Date(today.setDate(today.getDate() - 30))
    const year = pastDate.getFullYear()
    const month = (pastDate.getMonth() + 1).toString().padStart(2, '0')
    const day = pastDate.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
}

// Dynamic query using date from last 30 days
const last30DaysDate = getLast30DaysDate()
// const googleQuery = `("junior frontend developer" OR "junior fullstack developer" OR "junior web developer" OR "מפתח ג'וניור" OR "junior מפתח" OR "מפתח אתרים" OR "react") ("Israel" OR "ישראל") -senior inurl:/careers after:${last30DaysDate}
// `
const googleQuery = `("סטודנט הנדסת תעשייה וניהול" OR "סטודנטית הנדסת תעשייה וניהול" OR "מנהל פרויקטים ג'וניור" OR "אנליסט" OR "אנליסטית" OR "תעשייה וניהול" OR "מנתח מערכות" OR "Junior analyst" OR "Project Manager") ("ישראל" OR "Israel") after:2024-10-17

`

// Email Configuration
const emailConfig = {
    service: 'Gmail',
    auth: {
        user: 'barbenbh@gmail.com',
        pass: 'gxhkstwvoumhhbae',
    },
}

const recipientEmail = 'barbenbh@gmail.com'
const sentLinksFile = 'sent_links.json'

// Load previously sent links from file
function loadSentLinks() {
    if (fs.existsSync(sentLinksFile)) {
        const data = fs.readFileSync(sentLinksFile, 'utf-8')
        return JSON.parse(data)
    }
    return []
}

// Save new links to the sent links file
function saveSentLinks(links) {
    fs.writeFileSync(sentLinksFile, JSON.stringify(links, null, 2), 'utf-8')
}

;(async () => {
    const browser = await puppeteer.launch({ headless: false })
    const page = await browser.newPage()

    try {
        console.log('Opening Google...')
        await page.goto('https://www.google.com/', { waitUntil: 'networkidle2' })

        // Accept cookies if the button appears
        try {
            await page.waitForSelector('button[aria-label="Accept all"]', { timeout: 3000 })
            await page.click('button[aria-label="Accept all"]')
            console.log('Accepted cookies.')
        } catch (e) {
            console.log('No cookie banner found, continuing...')
        }

        // Wait to ensure Google search box is fully loaded
        await delay(2000)

        // Attempt to locate the search input directly
        console.log('Attempting to locate search input...')
        const inputSelector = 'input[name="q"], input[type="text"], input[type="textarea"], textarea'
        await page.waitForSelector(inputSelector, { visible: true, timeout: 5000 })

        console.log('Typing query into search box...')
        await page.click(inputSelector)
        await page.type(inputSelector, googleQuery, { delay: 100 })

        // Press Enter to submit the search
        console.log('Submitting search...')
        await page.keyboard.press('Enter')
        console.log('Search submitted, waiting for results...')

        // Wait for search results to load
        await page.waitForSelector('#search', { timeout: 20000 })

        console.log('Extracting job links and titles...')
        const jobData = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('#search .g'))
                .map(result => {
                    const titleElement = result.querySelector('h3')
                    const linkElement = result.querySelector('a')
                    const title = titleElement ? titleElement.innerText : null
                    const link = linkElement ? linkElement.href : null
                    return title && link ? { title, link } : null
                })
                .filter(item => item && item.link.includes('/careers'))
        })

        if (jobData.length === 0) {
            console.log('No job links found.')
            return
        }

        // Load previously sent links
        const sentLinks = loadSentLinks()
        const newJobs = jobData.filter(job => !sentLinks.includes(job.link))

        if (newJobs.length === 0) {
            console.log('No new job links to send.')
            return
        }

        console.log(`Found ${newJobs.length} new job links.`)
        console.log('Sending email with new job links...')

        // Format the email content with titles and links
        const emailBody = newJobs.map(job => `🔗 ${job.title}\n${job.link}`).join('\n\n')

        const transporter = nodemailer.createTransport(emailConfig)
        const mailOptions = {
            from: emailConfig.auth.user,
            to: recipientEmail,
            subject: 'New Job Listings',
            text: `Here are the latest job listings:\n\n${emailBody}`,
        }

        await transporter.sendMail(mailOptions)
        console.log('Email sent successfully.')

        // Update sent links file
        const updatedSentLinks = [...sentLinks, ...newJobs.map(job => job.link)]
        saveSentLinks(updatedSentLinks)
        console.log('Sent links file updated.')
    } catch (error) {
        console.error('An error occurred:', error)
        await page.screenshot({ path: 'error_screenshot.png' })
        console.log('Screenshot saved as error_screenshot.png for debugging.')
    } finally {
        await browser.close()
    }
})()
