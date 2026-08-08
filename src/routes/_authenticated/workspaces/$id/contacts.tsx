import { CONTACT_SORTS, CONTACT_STATUSES } from '@/entities/contact'
import { DEFAULT_CONTACT_SORT } from '@/features/contacts'
import {
  Outlet,
  createFileRoute,
  retainSearchParams,
  stripSearchParams,
} from '@tanstack/react-router'
import { z } from 'zod'

/**
 * The directory's list state lives on the *layout* route, so
 * `/contacts/$contactId` inherits it and returning from a contact restores the
 * search, filters, sort and page by construction rather than by remembering to
 * thread them through every link.
 *
 * Every field `.catch()`es to its default: a hand-edited or stale URL should
 * render a sane list, not an error page. The same bounds are enforced again
 * inside `search_workspace_contacts`, which clamps limit/offset and falls back
 * on an unrecognised sort — the client is not trusted to be the only guard.
 */
const defaults = {
  query: '',
  status: [] as Array<(typeof CONTACT_STATUSES)[number]>,
  owner: [] as Array<string>,
  unowned: false,
  sort: DEFAULT_CONTACT_SORT,
  page: 1,
  // The Archived view. In the URL like every other filter, so it survives a
  // reload and a trip into a contact. `ContactsPage` ignores it for a member —
  // the RPC behind it is owner/admin only — so a shared link cannot leak a view.
  archived: false,
}

// `.catch()` keeps a bad value from throwing, but leaves the key REQUIRED in the
// schema's input type, which would force every `<Link to="/…/contacts">` in the
// app to restate the whole list state. `.default()` on top makes the key optional
// on the way in and guaranteed on the way out, so links stay clean and
// `Route.useSearch()` still returns a fully populated object.
const withDefault = <T extends z.ZodType, TFallback>(
  schema: T,
  fallback: TFallback,
) => schema.catch(fallback as never).default(fallback as never)

const contactsSearchSchema = z.object({
  query: withDefault(z.string().max(128), defaults.query),
  status: withDefault(z.array(z.enum(CONTACT_STATUSES)), defaults.status),
  owner: withDefault(z.array(z.uuid()), defaults.owner),
  unowned: withDefault(z.boolean(), defaults.unowned),
  sort: withDefault(z.enum(CONTACT_SORTS), defaults.sort),
  page: withDefault(z.number().int().min(1).max(10_000), defaults.page),
  archived: withDefault(z.boolean(), defaults.archived),
})

export type ContactsSearch = z.infer<typeof contactsSearchSchema>

export const Route = createFileRoute('/_authenticated/workspaces/$id/contacts')(
  {
    validateSearch: contactsSearchSchema,
    search: {
      middlewares: [
        // Opening a contact keeps the list state without every Link restating it…
        retainSearchParams([
          'query',
          'status',
          'owner',
          'unowned',
          'sort',
          'page',
          'archived',
        ]),
        // …and defaults stay out of the URL, so a plain /contacts link is clean.
        stripSearchParams(defaults),
      ],
    },
    component: RouteComponent,
  },
)

function RouteComponent() {
  return <Outlet />
}
