"use strict"
const axios = require("axios")

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

    const { TranslatedText } = await this.translatorSvc
      .translateText(params)
      .promise()

    return TranslatedText.split(" e ")
  }

  // Constroi uma lista com mensagens com as chances de cada rotulo
  formatTextResults(texts, workingItems) {
    const formattedText = []

    for (const index in texts) {
      // Acessa o nome traduzido
      const portugueseName = texts[index]
      // Acessa a confianca
      const confidence = workingItems[index].Confidence
      formattedText.push(
        `${confidence.toFixed(2)}% de chance de conter ${portugueseName}`,
      )
    }

    return formattedText
  }

  async getImageBuffer(imageUrl) {
    return await axios
      .get(imageUrl, {
        responseType: "arraybuffer",
      })
      .then(({ data }) => Buffer.from(data, "base64"))
  }

  async main(event) {
    try {
      const { imageUrl } = event.queryStringParameters

      console.log("Downloading image...")
      const imageBuffer = await this.getImageBuffer(imageUrl)

      console.log("Detecting labels...")
      const { names, workingItems } = await this.detectImageLabels(imageBuffer)

      console.log("Translating results to portuguese...")
      const translatedNames = await this.translateText(names)

      // console.log(names, workingItems, translatedNames)
      console.log("Formatting text...")
      const formattedText = await this.formatTextResults(
        translatedNames,
        workingItems,
      )

      console.log("Wrapping up...")

      return {
        statusCode: 200,
        body: `A imagem tem:\n${formattedText.join("\n")}`,
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
const { format } = require("path")
const rekoSvc = new aws.Rekognition()
const translatorSvc = new aws.Translate()
const handler = new Handler({
  rekoSvc,
  translatorSvc,
})

module.exports.main = handler.main.bind(handler)
