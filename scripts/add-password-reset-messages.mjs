#!/usr/bin/env node
/**
 * Adds the message keys the password-reset route needs.
 *
 * The route shipped as router scaffolding rendering the literal
 * `Hello "/password-reset"!`, reachable from the "Forgot password?" link on
 * sign-in. Building it needs its own copy in both locales.
 *
 * Usage: node scripts/add-password-reset-messages.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

/** key -> [en, ru] */
const NEW_MESSAGES = {
  password_reset_request_title: ['Reset your password', 'Восстановление пароля'],
  password_reset_request_description: [
    'Enter the email you sign in with. We’ll send a link that lets you set a new password.',
    'Укажите почту, с которой вы входите. Пришлём ссылку для смены пароля.',
  ],
  password_reset_request_submit: ['Send the link', 'Отправить ссылку'],
  password_reset_request_pending: ['Sending…', 'Отправляем…'],
  password_reset_sent_title: ['Check your email', 'Проверьте почту'],
  // Deliberately unconditional: saying "no such account" would let anyone test
  // whether an address is registered here.
  password_reset_sent_description: [
    'If {email} has an account, a reset link is on its way. It expires in an hour.',
    'Если у {email} есть аккаунт, ссылка уже в пути. Она действует час.',
  ],
  password_reset_sent_resend: ['Send it again', 'Отправить ещё раз'],
  password_reset_back_to_sign_in: ['Back to sign in', 'Вернуться ко входу'],
  password_reset_request_error: [
    'Couldn’t send the link. Try again in a moment.',
    'Не удалось отправить ссылку. Попробуйте через минуту.',
  ],

  password_reset_update_title: ['Choose a new password', 'Новый пароль'],
  password_reset_update_description: [
    'This link signs you in once so you can set a new password.',
    'По этой ссылке вы вошли один раз — задайте новый пароль.',
  ],
  password_reset_update_submit: ['Save the password', 'Сохранить пароль'],
  password_reset_update_success: ['Password updated', 'Пароль обновлён'],
}

function apply(path, index) {
  const messages = JSON.parse(readFileSync(path, 'utf8'))
  let added = 0
  for (const [key, values] of Object.entries(NEW_MESSAGES)) {
    if (key in messages) continue
    messages[key] = values[index]
    added += 1
  }
  writeFileSync(path, `${JSON.stringify(messages, null, 2)}\n`)
  console.log(`${path}: added ${added} messages`)
}

apply('messages/en.json', 0)
apply('messages/ru.json', 1)
