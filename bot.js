require("dotenv").config()

const { Telegraf }  = require("telegraf")
const mongoose      = require("mongoose")
const fs            = require("fs")

mongoose.connect("mongodb://127.0.0.1:27017/tlusers")

const userSchema = new mongoose.Schema({
    user_id: Number,
    is_admin: {
        type: Boolean,
        default: false
    },
    subscribed: {
        type: Boolean,
        default: true
    },
})

const User = mongoose.model('User', userSchema)

const bot = new Telegraf(process.env.BOT_TOKEN)

const sendContactLinks = (ctx) => {
    const config = getConfig()
    if (!config.socials) {
        ctx.reply("Упс, у меня пока нет информации о контактах. Я буду рад поделиться ими с вами как только появиться возможность! :)")
        return
    }

    let links = []

    items = config.socials.split("\n")

    let comb = []
    for (let i = 0; i < items.length; i++) {
        if (i % 2 === 0) {
            links.push(comb)
            comb = []
        }

        const info = items[i].split("-")

        comb.push({ text: info[0].trim(), url: info[1].trim() })
    }

    if (comb.length > 0) {
        links.push(comb)
    }

    ctx.reply(
        'Привет, вот тебе ссылки на мои социальные сети:',
        {
            reply_markup: {
                inline_keyboard: links
            }
        }
    )
}

bot.start(async (ctx) => {
    const chat_id = ctx.message.chat.id
    const user = await User.findOne({user_id: chat_id})

    if (user) {
        return
    }

    sendContactLinks(ctx)

    const newUser = new User()
    newUser.user_id = chat_id

    await newUser.save()
})

bot.command('contacts', async (ctx) => {
    sendContactLinks(ctx)
})

bot.command("subscribe", async (ctx) => {
    const chat_id = ctx.message.chat.id
    const user = await User.findOne({user_id: chat_id})

    if (!user) {
        return
    }

    if (user.subscribed) {
        ctx.reply("Вы уже подписаны на рассылку!")
        return
    }

    user.subscribed = true

    await user.save()

    ctx.reply("Вы успешно подписались на рассылку!")
})

bot.command("unsubscribe", async (ctx) => {
    const chat_id = ctx.message.chat.id
    const user = await User.findOne({user_id: chat_id})

    if (!user) {
        return
    }

    if (!user.subscribed) {
        ctx.reply("Вы уже отписались от рассылки!")
        return
    }

    user.subscribed = false

    await user.save()

    ctx.reply("Вы успешно отписались от рассылки!\nВы можете подписаться на рассылку в любое время при помощи команды /subscribe")
})

const stripCommand = (message) => {
    let text = message.split(" ")
    text.shift()

    return text.join(" ")
}

let messageThreading = false
bot.command('message', async (ctx) => {
    const chat_id = ctx.message.chat.id
    const user = await User.findOne({user_id: chat_id})
    if (!user.is_admin) {
        return
    }

    if (messageThreading) {
        ctx.reply("Вы уже недавно делали рассылку! Придется подождать немного")
        return
    }

    const text = stripCommand(ctx.update.message.text)

    ctx.reply("Рассылка с данным сообщением успешно начата!")

    const users = await User.find({ subscribed: true })

    let i = 0
    messageThreading = true
    const usersBulk = setInterval(() => {
        const user = users[i]

        if (i >= users.length) {
            clearInterval(usersBulk)
            console.log("Bulk is completed!")
            messageThreading = false
            return
        }

        i = i + 1

        if (user.user_id === chat_id) {
            return
        }

        if (!user.subscribed) {
            return
        }

        ctx.telegram.sendMessage(user.user_id, text);
    }, 1000)
})

const getConfig = () => {
    let config = fs.readFileSync("./config.json", "utf8")
    if (config) {
        config = JSON.parse(config)
    } else {
        fs.writeFileSync("./config.json", JSON.stringify({}), {flag: "w"})
        config = {}
    }

    return config
}

const saveConfig = (data) => {
    fs.writeFileSync("./config.json", JSON.stringify(data), {flag: "w"})
}

bot.command("editlinks", async (ctx) => {
    const chat_id = ctx.message.chat.id
    const user = await User.findOne({user_id: chat_id})
    if (!user.is_admin) {
        return
    }
    
    const config = getConfig()
    config.socials = stripCommand(ctx.update.message.text)

    ctx.reply("Вы успешно обновили ссылки на социальные сети!")

    saveConfig(config)
})

bot.command('editabout', async (ctx) => {
    const chat_id = ctx.message.chat.id
    const user = await User.findOne({user_id: chat_id})
    if (!user.is_admin) {
        return
    }

    const config = getConfig()
    config.about = stripCommand(ctx.update.message.text)

    ctx.reply("Вы успешно сменили ваше описание!")

    saveConfig(config)
})

bot.command("about", async (ctx) => {
    ctx.reply(getConfig().about || "Здесь должно быть описание, но пока что тут заглушка! Увы...")
})

bot.launch()