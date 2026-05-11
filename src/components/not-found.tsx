import { Link } from '@tanstack/react-router'
import { SidebarInset } from './sidebar'
import { m } from '@/paraglide/messages'

export function NotFound() {
  return (
    <SidebarInset>
      <div className="flex flex-col items-center justify-center">
        <h1 className="text-4xl font-bold">{m.not_found_title()}</h1>
        <p className="text-lg">{m.not_found_description()}</p>
        <Link to="/" className="link">
          {m.not_found_go_home_link()}
        </Link>
      </div>
    </SidebarInset>
  )
}
