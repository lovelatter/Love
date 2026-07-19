const { Markup } = require('telegraf');
const locale = require('./locale');

module.exports = {
    sendMainMenu: (ctx, isEdit = false) => {
        const fullName = `${ctx.from?.first_name || ""} ${ctx.from?.last_name || ""}`.trim() || "ব্যবহারকারী";
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback(locale.btn_make, 'menu_makelink')],
            [Markup.button.callback(locale.btn_feedback, 'menu_feedback'), Markup.button.callback(locale.btn_help, 'menu_help')]
        ]);
        if (isEdit) return ctx.editMessageText(locale.welcome(fullName), { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
        return ctx.reply(locale.welcome(fullName), { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
    }
};
