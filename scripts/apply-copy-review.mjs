#!/usr/bin/env node
/**
 * Applies the copy review to the message catalogues.
 *
 * Every entry below is a deliberate replacement, keyed by message ID, with the
 * old value asserted so this cannot silently no-op after the catalogue moves on.
 * The classes of defect it fixes:
 *
 *   - Russian machine-translation artefacts. `baseLocale` is `ru`, so these are
 *     the primary experience, not a fallback: calqued English word order,
 *     "рабочее пространство" repeated four times in one screen, `е` where the
 *     word needs `ё`, and nouns that do not agree with what the UI does.
 *   - Terminology drift. The same object was a "диалог", a "переписка" and a
 *     "чат" depending on the screen; contacts were "клиенты" in some strings and
 *     "контакты" in others. One product noun per concept, in both locales.
 *   - English apostrophes mixed between `'` and `’` inside one interface.
 *   - Copy that describes a layout the app no longer has ("the list on the
 *     left" is a single pane on mobile), or that praises the user for an empty
 *     queue instead of stating it.
 *
 * Usage: node scripts/apply-copy-review.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

/** @type {Record<string, [expected: string, replacement: string]>} */
const EN = {
  // Straight apostrophes → typographic, matching the account/settings strings
  // that already use ’. One interface, one apostrophe.
  auth_sign_in_dont_have_an_account_label: [
    "Don't have an account?",
    'Don’t have an account?',
  ],
  inbox_readiness_error_title: [
    "Could not check this workspace's channels",
    'Couldn’t check this workspace’s channels',
  ],
  channels_telegram_error_forbidden: [
    "You don't have permission to add channels",
    'You don’t have permission to add channels',
  ],
  channels_whatsapp_error_forbidden: [
    "You don't have permission to add channels",
    'You don’t have permission to add channels',
  ],
  channels_instagram_error_forbidden: [
    "You don't have permission to add channels",
    'You don’t have permission to add channels',
  ],
  channels_whatsapp_reconnect_form_subtitle: [
    "Sign in again to replace this channel's credentials. Conversations and history stay unchanged",
    'Sign in again to replace this channel’s credentials. Conversations and history stay unchanged',
  ],
  channels_whatsapp_not_configured: [
    "WhatsApp sign-in isn't configured yet. Add the Meta app credentials to enable it",
    'WhatsApp sign-in isn’t configured yet. Add the Meta app credentials to enable it',
  ],
  channels_whatsapp_error_login: [
    "Facebook sign-in didn't complete. Allow pop-ups for this site and try again",
    'Facebook sign-in didn’t complete. Allow pop-ups for this site and try again',
  ],
  channels_whatsapp_error_timeout: [
    "WhatsApp sign-in didn't complete. Please try again",
    'WhatsApp sign-in didn’t complete. Try again',
  ],
  channels_instagram_requirement: [
    "You need an Instagram Business or Creator account. Personal accounts can't receive messages through the API",
    'You need an Instagram Business or Creator account. Personal accounts can’t receive messages through the API',
  ],
  channels_instagram_reconnect_discard_description: [
    "You'll cancel reconnecting this Instagram account. Your currently stored credentials remain unchanged",
    'This cancels reconnecting the account. Your stored credentials stay unchanged',
  ],
  channels_instagram_not_configured: [
    "Instagram sign-in isn't configured yet. Add the Meta app credentials to enable it",
    'Instagram sign-in isn’t configured yet. Add the Meta app credentials to enable it',
  ],
  channels_instagram_error_missing_permission: [
    "Instagram messaging access wasn't granted. Reconnect and allow messaging when prompted",
    'Instagram messaging access wasn’t granted. Reconnect and allow messaging when prompted',
  ],
  channels_instagram_error_account_mismatch: [
    "That's a different Instagram account. Create a new channel instead of reconnecting",
    'That’s a different Instagram account. Create a new channel instead of reconnecting',
  ],
  channels_instagram_error_timeout: [
    "Instagram sign-in didn't complete. Please try again",
    'Instagram sign-in didn’t complete. Try again',
  ],
  inbox_composer_offline_notice: [
    "You're offline. Reconnect to send.",
    'You’re offline. Reconnect to send.',
  ],
  home_attention_reason_unread_hint: [
    "New messages you haven't read yet",
    'New messages you haven’t read yet',
  ],
  notifications_popover_empty_title: [
    "You're all caught up",
    'You’re all caught up',
  ],
  inbox_unsupported_message: [
    "This message type isn't supported yet",
    'This message type isn’t supported yet',
  ],

  // "Could not" / "Couldn't" were split across the catalogue at random. The
  // account area already contracts; the rest now matches it.
  home_summary_error: ["Couldn't load your numbers", 'Couldn’t load your summary'],
  common_unknown_error: ['Something went wrong', 'Something went wrong'],

  // Please-try-again is filler in an interface: the retry affordance is the
  // instruction. Keep the cause, drop the politeness.
  channels_telegram_error_invalid_token: [
    'Invalid bot token. Please check and try again',
    'That bot token isn’t valid. Check it and try again',
  ],
  channels_whatsapp_error_invalid: [
    'Could not verify your WhatsApp sign-in. Please try again',
    'Couldn’t verify your WhatsApp sign-in. Try again',
  ],
  channels_instagram_error_invalid_code: [
    'Could not verify your Instagram sign-in. Please try again',
    'Couldn’t verify your Instagram sign-in. Try again',
  ],
  channels_instagram_error_state_mismatch: [
    'This sign-in link is invalid or has expired. Please try again',
    'This sign-in link has expired. Start the connection again',
  ],
  channels_instagram_error_oauth: [
    'Instagram sign-in failed. Please try again',
    'Instagram sign-in failed. Try again',
  ],

  // "We are still building this" is the team talking about itself. Say what the
  // reader can do instead.
  channels_coming_soon_body: [
    'We are still building this integration. Pick another channel for now or check back later',
    'This integration isn’t ready yet. Connect another channel for now',
  ],
  workspace_settings_members_invite_description: [
    'Send an invite link to a teammate. We will email them a one-click join link',
    'Email a teammate a link that adds them to this workspace',
  ],

  // Praise for an empty queue reads as a participation trophy on a work tool.
  // State the condition; the check mark already carries the tone.
  home_attention_empty_title: ['Good job!', 'You’re all caught up'],
  home_attention_empty_description: [
    'Nothing waiting on you right now',
    'Nothing assigned to you needs a reply',
  ],

  // Described a two-pane layout the app only has above the mobile breakpoint.
  inbox_empty_select_conversation_description: [
    'Open a thread from the list on the left to start replying',
    'Choose a conversation to read it and reply',
  ],

  // "going stale" / "Stale" is jargon for "nobody replied". Say the thing.
  home_summary_stale_hint: [
    'No reply sent for over 2 days',
    'Waiting on a reply for more than 2 days',
  ],
  home_attention_reason_stale: ['Stale', 'No reply'],
  home_attention_reason_stale_hint: [
    'No reply sent for over 2 days',
    'Waiting on a reply for more than 2 days',
  ],

  // The workspace dashboard is a real, empty screen; "under construction" is a
  // developer's note, and the reader only needs the door out.
  workspace_overview_empty_description: [
    'The workspace dashboard is under construction. Your conversations live in the inbox.',
    'This workspace has no overview yet. Your conversations are in the inbox.',
  ],

  // 404 pages that shout "404" bury the one useful sentence under a number.
  not_found_title: ['404', 'Page not found'],
  not_found_description: ['Page not found', 'The page you followed doesn’t exist, or it moved.'],
  not_found_go_home_link: ['Go to home', 'Back to home'],

  // "Signing in." with a full stop was a typo for the ellipsis every other
  // pending label uses.
  auth_sign_in_signing_in: ['Signing in.', 'Signing in…'],

  // Placeholders should look like the answer, not restate the label.
  workspaces_name_placeholder: ['Workspace name', 'Acme Sales'],
  workspaces_description_placeholder: [
    'Workspace description',
    'Inbound sales for the EU region',
  ],

  // Two keys, one screen, same word: the modal title and the page heading.
  workspaces_create_modal_title: ['Create workspace', 'Create a workspace'],

  // New keys' English source, added for parity with ru (see MISSING below).
  profile_identity_title: ['Your details', 'Your details'],
  profile_identity_description: [
    'Your teammates see this in every workspace you belong to.',
    'Your teammates see this in every workspace you belong to.',
  ],
}

/** @type {Record<string, [expected: string, replacement: string]>} */
const RU = {
  // --- Terminology -----------------------------------------------------------
  // One noun per concept. The catalogue used "диалог" (24×), "переписка" (9×)
  // and "чат" for the same object. "Диалог" wins: it is what the status chips,
  // the filters and the thread header already say, and "переписка" also means
  // the whole correspondence, which is a different thing from one thread.
  onboarding_description: [
    'В рабочем пространстве собраны ваши переписки, контакты и команда.',
    'Здесь собраны диалоги, контакты и команда.',
  ],
  workspace_settings_members_description: [
    'Пользователи с доступом к этому рабочему пространству и его перепискам',
    'У кого есть доступ к пространству и его диалогам',
  ],
  channels_empty_description: [
    'Подключите WhatsApp, Telegram или Instagram, чтобы получать переписки с клиентами во входящих',
    'Подключите WhatsApp, Telegram или Instagram — диалоги с клиентами будут приходить во входящие',
  ],
  channels_ready_description: [
    'Переписки из этого канала теперь поступают во входящие',
    'Диалоги из этого канала теперь приходят во входящие',
  ],
  channels_disconnect_confirm_description: [
    'После отключения канала «{name}» новые сообщения через него поступать не будут. Существующие переписки останутся во входящих',
    'Новые сообщения через «{name}» приходить перестанут. Уже начатые диалоги останутся во входящих',
  ],
  channels_activate_confirm_description: [
    'После активации канала «{name}» новые переписки снова будут поступать в это рабочее пространство через этот канал',
    'Новые диалоги через «{name}» снова начнут приходить во входящие',
  ],
  channels_instagram_reconnect_form_subtitle: [
    'Авторизуйте тот же аккаунт заново, чтобы продолжать получать сообщения. Переписки и история сохранятся',
    'Войдите в тот же аккаунт заново, чтобы сообщения приходили дальше. Диалоги и история сохранятся',
  ],
  inbox_primary_filter_aria_label: ['Фильтровать переписки', 'Фильтровать диалоги'],
  inbox_empty_select_conversation_description: [
    'Откройте сообщение из списка слева, чтобы начать переписку',
    'Выберите диалог, чтобы прочитать его и ответить',
  ],

  // --- Machine-translation artefacts ----------------------------------------
  // "Ваша CRM для современных диалогов с клиентами" is the English sentence in
  // Russian words: "современные диалоги" is not a thing a salesperson says.
  auth_sign_in_brand_tagline: [
    'Ваша CRM для современных диалогов с клиентами',
    'Все обращения клиентов — в одном окне',
  ],
  auth_sign_in_description: [
    'Введите email и пароль для входа',
    'Войдите по email и паролю',
  ],
  auth_sign_up_description: [
    'Введите данные для создания аккаунта',
    'Заполните три поля — и всё',
  ],
  auth_sign_in_email_invalid: [
    'Введите корректный email адрес',
    'Проверьте адрес: похоже, в нём опечатка',
  ],
  auth_sign_up_needs_confirmation: [
    'Подтвердите email для продолжения',
    'Подтвердите почту',
  ],
  auth_sign_in_signing_in: ['Вход.', 'Входим…'],

  // "рабочее пространство" four times per screen is what a translation memory
  // does, not what a person writes. The switcher already names the workspace,
  // so most of these can say "пространство" or drop the noun entirely.
  onboarding_title: ['Создайте рабочее пространство', 'Создайте пространство'],
  onboarding_workspace_name_label: [
    'Название рабочего пространства',
    'Название пространства',
  ],
  onboarding_submit: ['Создать рабочее пространство', 'Создать пространство'],
  onboarding_submit_pending: ['Создаём рабочее пространство…', 'Создаём…'],
  onboarding_error_title: [
    'Не удалось создать рабочее пространство',
    'Не удалось создать пространство',
  ],
  onboarding_status_error_title: [
    'Не удалось проверить рабочие пространства',
    'Не удалось проверить ваши пространства',
  ],
  workspaces_load_error_title: [
    'Не удалось загрузить рабочие пространства',
    'Не удалось загрузить пространства',
  ],
  workspaces_create_button: ['Создать рабочее пространство', 'Создать пространство'],
  workspaces_create_error_title: [
    'Не удалось создать рабочее пространство',
    'Не удалось создать пространство',
  ],
  workspaces_create_modal_title: [
    'Создание рабочего пространства',
    'Новое пространство',
  ],
  workspaces_create_success: ['Рабочее пространство создано', 'Пространство создано'],
  workspaces_name_placeholder: ['Название рабочего пространства', 'Отдел продаж'],
  workspaces_description_placeholder: [
    'Описание рабочего пространства',
    'Входящие заявки по России',
  ],
  workspaces_name_helper: [
    'Введите название для вашего рабочего пространства',
    'По нему вы найдёте пространство в списке',
  ],
  workspaces_description_helper: [
    'Введите описание для вашего рабочего пространства',
    'Коротко — чем занимается эта команда',
  ],
  workspace_settings_kicker: ['Рабочее пространство', 'Пространство'],
  workspace_settings_loading_title: [
    'Настройки рабочего пространства',
    'Настройки пространства',
  ],
  workspace_settings_description: [
    'Управляйте оформлением, доступом и каналами связи для этого рабочего пространства',
    'Название и иконка, участники и каналы связи',
  ],
  workspace_settings_update_error_title: [
    'Не удалось обновить рабочее пространство',
    'Не удалось сохранить изменения',
  ],
  workspace_settings_load_error: [
    'Не удалось загрузить настройки рабочего пространства',
    'Не удалось загрузить настройки пространства',
  ],
  workspace_settings_general_description: [
    'Измените название, описание и иконку, отображаемые в боковой панели',
    'Название, описание и иконка — их видно в боковой панели',
  ],
  workspace_settings_members_list_title: [
    'Участники рабочего пространства',
    'Кто состоит',
  ],
  channels_list_description: [
    'Через эти каналы клиенты пишут в это рабочее пространство',
    'Через эти каналы клиенты пишут вам',
  ],
  channels_connect_description: [
    'Выберите, откуда должны приходить сообщения. К одному рабочему пространству можно подключить несколько каналов',
    'Выберите, откуда приходят сообщения. Каналов может быть несколько',
  ],
  channels_telegram_error_duplicate: [
    'Этот бот уже подключён к вашему рабочему пространству',
    'Этот бот уже подключён',
  ],
  channels_whatsapp_error_duplicate: [
    'Этот номер WhatsApp уже подключён к вашему рабочему пространству',
    'Этот номер WhatsApp уже подключён',
  ],
  dashboard_empty_description: [
    'Создайте первое рабочее пространство, чтобы начать получать сообщения',
    'Создайте пространство, чтобы начать получать сообщения',
  ],
  dashboard_empty_cta: ['Создать рабочее пространство', 'Создать пространство'],
  dashboard_empty_title: ['Пока нет рабочих пространств', 'Пока нет пространств'],
  dashboard_page_title: ['Ваши рабочие пространства', 'Ваши пространства'],
  dashboard_page_description: [
    'Активность во всех ваших рабочих пространствах',
    'Что происходит во всех пространствах',
  ],
  profile_workspaces_title: ['Рабочие пространства', 'Пространства'],
  profile_workspaces_description: [
    'Ваши пространства и роль в каждом.',
    'Где вы состоите и с какой ролью.',
  ],
  profile_workspaces_empty: [
    'Вы пока не состоите ни в одном рабочем пространстве.',
    'Вы пока не состоите ни в одном пространстве.',
  ],
  profile_workspaces_load_error: [
    'Не удалось загрузить рабочие пространства.',
    'Не удалось загрузить пространства.',
  ],
  profile_workspaces_managed_note: [
    'Ролями управляют администраторы рабочего пространства.',
    'Роли назначают администраторы пространства.',
  ],
  workspace_overview_empty_description: [
    'Дашборд рабочего пространства ещё в разработке. Все диалоги находятся во входящих.',
    'Сводки по пространству пока нет. Все диалоги — во входящих.',
  ],
  sidebar_select_workspace_label: ['Выбрать рабочее пространство', 'Выбрать пространство'],
  sidebar_inbox_locked_tooltip: [
    'Подключите канал, чтобы открыть входящие.',
    'Подключите канал — тогда откроются входящие',
  ],
  inbox_readiness_error_title: [
    'Не удалось проверить каналы этого рабочего пространства',
    'Не удалось проверить каналы этого пространства',
  ],

  // --- ё, and participles that need it ---------------------------------------
  inbox_thread_unavailable_description: [
    'Возможно, диалог удален, перенесен или у вас больше нет доступа.',
    'Возможно, диалог удалён, перенесён или к нему больше нет доступа.',
  ],

  // --- Copy that describes the wrong thing -----------------------------------
  inbox_list_empty_description: [
    'Здесь будут появляться новые сообщения от клиентов',
    'Новые сообщения от клиентов появятся здесь',
  ],
  inbox_list_search_empty: ['Ничего не найдено', 'Ничего не нашлось'],
  inbox_composer_offline_notice: [
    'Нет подключения. Восстановите связь, чтобы отправить.',
    'Нет сети. Сообщение отправится, когда связь вернётся.',
  ],
  inbox_composer_voice_label: ['Удерживайте для диктовки', 'Удерживайте, чтобы диктовать'],
  inbox_composer_voice_hold_to_record: [
    'Удерживайте для записи',
    'Удерживайте, чтобы диктовать',
  ],
  inbox_media_video_unsupported: [
    'Браузер не может воспроизвести это видео',
    'Браузер не проигрывает это видео. Скачайте файл',
  ],
  inbox_media_audio_unsupported: [
    'Браузер не может воспроизвести это аудио',
    'Браузер не проигрывает это аудио. Скачайте файл',
  ],
  inbox_channel_inactive_error: [
    'Канал отключён. Активируйте его в настройках перед отправкой сообщений',
    'Канал отключён. Включите его в настройках, чтобы отправлять сообщения',
  ],

  // "Отлично!" is praise; "Всё чисто" already carries the tone without it.
  home_attention_empty_title: ['Отлично!', 'Всё разобрано'],
  home_attention_empty_description: [
    'Сейчас ничего вас не ждёт',
    'Ни один диалог не ждёт вашего ответа',
  ],
  home_summary_all_clear: [
    'Всё чисто. Назначенные на вас диалоги внимания не требуют',
    'Всё разобрано — ни один диалог не ждёт вашего ответа',
  ],
  home_summary_error: ['Не удалось загрузить показатели', 'Не удалось загрузить сводку'],
  home_summary_stale_hint: [
    'Без вашего ответа больше 2 дней',
    'Ждут вашего ответа больше 2 дней',
  ],
  home_attention_reason_stale: ['Без ответа', 'Без ответа'],
  home_attention_reason_stale_hint: [
    'Без вашего ответа больше 2 дней',
    'Ждёт вашего ответа больше 2 дней',
  ],
  home_attention_reason_snoozed_hint: [
    'Отсрочка закончилась. Пора вернуться к диалогу',
    'Отсрочка закончилась — пора вернуться к диалогу',
  ],
  home_summary_waking_hint: [
    'Отложенные диалоги вернутся в течение 24 часов',
    'Вернутся из отложенных в ближайшие сутки',
  ],
  home_greeting_night: ['Работаете допоздна', 'Доброй ночи'],
  home_team_new_hint: [
    'Свежие диалоги, которые ещё никто не взял',
    'Новые диалоги, которые никто пока не взял',
  ],
  home_team_new_error: [
    'Не удалось загрузить новые диалоги',
    'Не удалось загрузить новые диалоги',
  ],
  home_workspaces_stats_error: [
    'Не удалось загрузить активность пространств',
    'Не удалось загрузить активность по пространствам',
  ],

  // 404 that says only "404" tells the reader nothing they can act on.
  not_found_title: ['404', 'Страница не найдена'],
  not_found_description: [
    'Страница не найдена',
    'Такой страницы нет — возможно, она переехала.',
  ],
  not_found_go_home_link: ['Перейти на главную', 'На главную'],

  // --- Register: "Пожалуйста, попробуйте снова" is filler ---------------------
  channels_telegram_error_invalid_token: [
    'Неверный токен бота. Проверьте и попробуйте снова',
    'Токен не подошёл. Проверьте, что скопировали его целиком',
  ],
  channels_whatsapp_error_invalid: [
    'Не удалось подтвердить вход в WhatsApp. Попробуйте ещё раз',
    'Не удалось подтвердить вход в WhatsApp. Попробуйте ещё раз',
  ],
  channels_instagram_error_state_mismatch: [
    'Эта ссылка для входа недействительна или устарела. Попробуйте ещё раз',
    'Ссылка для входа устарела. Начните подключение заново',
  ],
  channels_coming_soon_body: [
    'Эта интеграция ещё в разработке. Выберите другой канал или вернитесь позже',
    'Эта интеграция ещё не готова. Пока подключите другой канал',
  ],
  workspace_settings_members_invite_description: [
    'Отправьте коллеге ссылку-приглашение на email для быстрого присоединения',
    'Отправим коллеге ссылку — по ней он войдёт в пространство',
  ],

  // --- Small precision fixes -------------------------------------------------
  common_unknown_error: ['Что-то пошло не так', 'Что-то пошло не так'],
  auth_sign_in_failed_to_sign_in: [
    'Не удалось войти, проверьте email и пароль',
    'Не удалось войти. Проверьте почту и пароль',
  ],
  auth_sign_up_failed_to_create_account_description: [
    'Проверьте данные и попробуйте снова',
    'Проверьте данные и попробуйте ещё раз',
  ],
  sidebar_unknown_email: ['Email не указан', 'Почта не указана'],
  security_provider_email: ['Почта и пароль', 'Почта и пароль'],
  profile_email_disabled_reason: [
    'Адрес входа изменить нельзя. Напишите нам, если он устарел.',
    'Адрес для входа изменить нельзя. Напишите нам, если он устарел.',
  ],
  profile_load_error_description: [
    'Показано то, что известно из входа в систему. Сохранение по-прежнему работает.',
    'Показываем то, что знаем из вашей учётной записи. Сохранение работает.',
  ],
  profile_save_error_description: [
    'Ваши данные на месте. Проверьте соединение и попробуйте ещё раз.',
    'Ничего не потерялось. Проверьте связь и попробуйте ещё раз.',
  ],
  profile_phone_description: [
    'Видят только коллеги. Клиентам номер не показывается.',
    'Виден только коллегам. Клиенты его не увидят.',
  ],
  profile_timezone_description: [
    'Время в диалогах показывается в этом поясе.',
    'В этом поясе показывается время в диалогах.',
  ],
  profile_avatar_error_upload: [
    'Не удалось загрузить фото. Попробуйте ещё раз.',
    'Не удалось загрузить фото. Попробуйте ещё раз.',
  ],
  security_password_description: [
    'Не менее 8 символов. Вы останетесь в системе на этом устройстве.',
    'Минимум 8 символов. На этом устройстве вы останетесь в аккаунте.',
  ],
  security_account_description: [
    'Как этот аккаунт проходит аутентификацию.',
    'Как вы входите в этот аккаунт.',
  ],
  security_sign_out_others_confirm_description: [
    'Все остальные устройства и браузеры, где выполнен вход в этот аккаунт, будут разлогинены. Этот сеанс останется активным.',
    'На всех других устройствах и в других браузерах вход будет завершён. Этот сеанс останется активным.',
  ],
  security_sessions_description: [
    'Устройства и браузеры, где сейчас выполнен вход в этот аккаунт.',
    'Устройства и браузеры, где сейчас открыт этот аккаунт.',
  ],
  settings_appearance_mode_description: [
    'Следовать настройке системы или выбрать одну и оставить её.',
    'Как в системе — или всегда светлая либо тёмная.',
  ],
  settings_notifications_preview_description: [
    'Управляйте тем, какая часть сообщения отображается в уведомлениях.',
    'Сколько текста показывать в уведомлении.',
  ],
  settings_notifications_permission_managed_help: [
    'Разрешение выдаёт или блокирует браузер, а не Rezzy.',
    'Разрешение выдаёт браузер, а не Rezzy.',
  ],
  settings_notifications_load_error_description: [
    'Настройки уведомлений не загрузились, поэтому они не показаны.',
    'Настройки уведомлений не загрузились, поэтому мы их не показываем.',
  ],
  settings_scope_this_browser: [
    'Настраивается отдельно в этом браузере.',
    'Настраивается отдельно в каждом браузере.',
  ],
  account_settings_description: [
    'Ваш профиль и настройки Rezzy. Настройки рабочих пространств находятся в самих пространствах.',
    'Ваш профиль и настройки Rezzy. Настройки пространств — внутри самих пространств.',
  ],
  channels_card_unnamed: ['Безымянный канал', 'Канал без названия'],
  channels_name_placeholder: ['Например, Поддержка', 'Например, «Поддержка»'],
  channels_telegram_name_placeholder: [
    'Например, Бот поддержки',
    'Например, «Бот поддержки»',
  ],
  channels_whatsapp_name_placeholder: [
    'Например, Отдел продаж',
    'Например, «Отдел продаж»',
  ],
  channels_instagram_name_placeholder: ['напр. Поддержка', 'Например, «Поддержка»'],
  channels_instagram_name_helper: [
    'Необязательно. Название для этого канала',
    'Необязательно — чтобы отличать этот канал от других',
  ],
  channels_whatsapp_name_helper: [
    'Необязательно. По умолчанию используется подтверждённое название компании на номере',
    'Необязательно — по умолчанию берём название компании, привязанное к номеру',
  ],
  channels_telegram_token_helper: [
    'Откройте @BotFather в Telegram, отправьте /newbot и вставьте сюда выданный токен',
    'Откройте @BotFather в Telegram, отправьте /newbot и вставьте сюда полученный токен',
  ],
  inbox_contact_panel_notes_placeholder: [
    'Внутренние заметки о клиенте',
    'Заметки для команды — клиент их не увидит',
  ],
  inbox_contact_panel_phone_empty: ['Номер не указан', 'Телефон не указан'],
  inbox_thread_empty_description: [
    'Отправьте первое сообщение клиенту {name}, чтобы начать диалог',
    'Напишите {name} первым, чтобы начать диалог',
  ],
  inbox_media_sticker_tgs_hint: [
    'Анимированный стикер Telegram (.tgs). Скачайте, чтобы открыть',
    'Анимированный стикер Telegram (.tgs) — скачайте, чтобы посмотреть',
  ],
  inbox_message_deleted: ['Это сообщение было удалено', 'Сообщение удалено'],
  inbox_unsupported_message: [
    'Этот тип сообщения пока не поддерживается',
    'Такие сообщения пока не поддерживаются',
  ],
  inbox_messages_loading_older: ['Загрузка более ранних сообщений', 'Загружаем историю'],
  notifications_popover_empty_description: [
    'Новые непрочитанные сообщения появятся здесь',
    'Новые сообщения появятся здесь',
  ],
  workspace_settings_members_empty: ['Пока нет участников', 'Пока никого нет'],
  workspace_settings_members_unknown_user: ['Участник', 'Без имени'],
  image_preview_load_error: [
    'Не удалось загрузить изображение',
    'Не удалось загрузить изображение',
  ],
}

/** Keys present in en.json but absent from ru.json. */
const MISSING_RU = {
  profile_identity_title: 'О вас',
  profile_identity_description: 'Это видят коллеги во всех ваших пространствах.',
}

function apply(path, replacements, additions = {}) {
  const raw = readFileSync(path, 'utf8')
  const messages = JSON.parse(raw)
  const problems = []
  let changed = 0

  for (const [key, [expected, replacement]] of Object.entries(replacements)) {
    if (!(key in messages)) {
      problems.push(`${key}: missing from ${path}`)
      continue
    }
    const current = messages[key]
    if (typeof current !== 'string') {
      problems.push(`${key}: not a simple message (already a variant?)`)
      continue
    }
    if (current !== expected) {
      problems.push(
        `${key}: expected\n    ${JSON.stringify(expected)}\n  but found\n    ${JSON.stringify(current)}`,
      )
      continue
    }
    if (current !== replacement) changed += 1
    messages[key] = replacement
  }

  for (const [key, value] of Object.entries(additions)) {
    if (key in messages) continue
    messages[key] = value
    changed += 1
  }

  if (problems.length > 0) {
    console.error(`\n${path}: ${problems.length} entries did not match:\n`)
    for (const problem of problems) console.error(`  ${problem}`)
    process.exitCode = 1
    return
  }

  writeFileSync(path, `${JSON.stringify(messages, null, 2)}\n`)
  console.log(`${path}: applied ${changed} copy changes`)
}

apply('messages/en.json', EN)
apply('messages/ru.json', RU, MISSING_RU)
