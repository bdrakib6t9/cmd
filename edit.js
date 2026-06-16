const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");

module.exports = {
config: {
name: "edit",
version: "1.0",
author: "Rakib",
countDown: 5,
role: 0,
shortDescription: "AI image editor",
longDescription: "Edit image using Stability AI",
category: "ai",
guide: {
en: "{pn} haircut"
}
},

onStart: async function ({ message, event, args }) {
	try {
		const reply = event.messageReply;

		if (!reply || !reply.attachments || !reply.attachments[0])
			return message.reply("Reply to an image first.");

		const prompt = args.join(" ");
		if (!prompt)
			return message.reply("Example: /edit haircut");

		const imageUrl = reply.attachments[0].url;

		const img = await axios.get(imageUrl, {
			responseType: "arraybuffer"
		});

		fs.writeFileSync("cache_edit.jpg", img.data);

		const form = new FormData();
		form.append("image", fs.createReadStream("cache_edit.jpg"));
		form.append("prompt", `Edit this image: ${prompt}`);

		const res = await axios.post(
			"https://api.stability.ai/v2beta/stable-image/edit/inpaint",
			form,
			{
				headers: {
					Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
					...form.getHeaders()
				},
				responseType: "arraybuffer"
			}
		);

		fs.writeFileSync("edited.png", res.data);

		await message.reply({
			body: `Edited: ${prompt}`,
			attachment: fs.createReadStream("edited.png")
		});

		fs.unlinkSync("cache_edit.jpg");
		fs.unlinkSync("edited.png");

	} catch (e) {
		console.log(e);
		message.reply("Image edit failed.");
	}
}

};
