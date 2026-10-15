import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  badge?: ReactNode
  actions?: ReactNode
}

/**
 * Standard page heading with title, subtitle description, and contextual action buttons.
 */
export function PageHeader({ title, description, badge, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-main">
        <div className="page-header-title-row">
          <h1 className="page-title">{title}</h1>
          {badge && <div className="page-header-badge">{badge}</div>}
        </div>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  )
}

