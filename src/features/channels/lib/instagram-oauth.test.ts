import { describe, expect, it } from 'vitest'
import {
  INSTAGRAM_SCOPES,
  buildInstagramAuthorizeUrl,
  mapOAuthErrorParam,
  parseOAuthMessage,
} from './instagram-oauth'

describe('buildInstagramAuthorizeUrl', () => {
  it('builds the authorize URL with the required params and scopes', () => {
    const url = new URL(
      buildInstagramAuthorizeUrl({
        appId: 'app-123',
        redirectUri: 'https://app.example/instagram-callback',
        state: 'nonce-abc',
      }),
    )
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://www.instagram.com/oauth/authorize',
    )
    expect(url.searchParams.get('client_id')).toBe('app-123')
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://app.example/instagram-callback',
    )
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('scope')).toBe(INSTAGRAM_SCOPES)
    expect(url.searchParams.get('state')).toBe('nonce-abc')
  })

  it('requests exactly the two MVP scopes (no deprecated names)', () => {
    expect(INSTAGRAM_SCOPES.split(',')).toEqual([
      'instagram_business_basic',
      'instagram_business_manage_messages',
    ])
  })
})

describe('parseOAuthMessage', () => {
  it('parses a successful callback message', () => {
    expect(
      parseOAuthMessage({
        type: 'INSTAGRAM_OAUTH',
        code: 'the-code',
        state: 'the-state',
        error: null,
      }),
    ).toEqual({ code: 'the-code', state: 'the-state', error: null })
  })

  it('parses an error callback message', () => {
    expect(
      parseOAuthMessage({ type: 'INSTAGRAM_OAUTH', error: 'access_denied' }),
    ).toEqual({ code: null, state: null, error: 'access_denied' })
  })

  it('ignores unrelated or malformed messages', () => {
    expect(parseOAuthMessage({ type: 'OTHER', code: 'x' })).toBeNull()
    expect(parseOAuthMessage('a string')).toBeNull()
    expect(parseOAuthMessage(null)).toBeNull()
  })
})

describe('mapOAuthErrorParam', () => {
  it('maps user denial to cancelled (no toast)', () => {
    expect(mapOAuthErrorParam('access_denied')).toBe('cancelled')
    expect(mapOAuthErrorParam('user_denied')).toBe('cancelled')
    expect(mapOAuthErrorParam('user_cancelled')).toBe('cancelled')
  })

  it('maps other errors to a generic oauth_error', () => {
    expect(mapOAuthErrorParam('server_error')).toBe('oauth_error')
    expect(mapOAuthErrorParam('invalid_scope')).toBe('oauth_error')
  })
})
