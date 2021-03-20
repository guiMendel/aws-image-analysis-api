"use strict"
// bib para ler arquivos
const {
  promises: { readFile },
} = require("fs")

class Handler {
  constructor({ rekoSvc, translatorSvc }) {
    this.rekoSvc = rekoSvc
    this.translatorSvc = translatorSvc
  }

  async detectImageLabels(buffer) {
    const result = await this.rekoSvc
      .detectLabels({
        Image: {
          Bytes: buffer,
        },
      })
      .promise()
    // Com o .promise nao precisamos passar callbacks para a aws. Ela faz promessas!

    // Pega so os que tem boa confianca
    const workingItems = result.Labels.filter(
      ({ Confidence }) => Confidence > 80,
    )

    const names = workingItems.map(({ Name }) => Name).join(" and ")

    return { names, workingItems }
  }

  async translateText(Text) {
    const params = {
      SourceLanguageCode: "en",
      TargetLanguageCode: "pt",
      Text,
    }

    return await this.translatorSvc.translateText(params).promise()
  }

  async main(event) {
    try {
      console.log("Detecting labels...")

      const imgBuffer = await readFile("./images/meme.jpg")
      const { names, workingItems } = await this.detectImageLabels(imgBuffer)

      console.log("Translating results to portuguese...")

      const translatedNames = await this.translateText(names)

      console.log(translatedNames)

      return {
        statusCode: 200,
        body: "Hey Jude",
      }
    } catch (error) {
      console.log("Error: ", error.stack)
      return {
        statusCode: 500,
        body: "Our server messed something up again...",
      }
    }
  }
}

// factory
const aws = require("aws-sdk")
const rekoSvc = new aws.Rekognition()
const translatorSvc = new aws.Translate()
const handler = new Handler({
  rekoSvc,
  translatorSvc,
})

module.exports.main = handler.main.bind(handler)
