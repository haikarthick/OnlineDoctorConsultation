import { TFunction } from 'i18next'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  t: TFunction
}

export default function Pagination({ page, totalPages, onPageChange, t }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="si-7f5fc3d9">
      <button disabled={page === 0} onClick={() => onPageChange(page - 1)} className="fd-page-nav">
        ← {t('findDoctor.previous')}
      </button>

      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
        let pageNum: number
        if (totalPages <= 7) {
          pageNum = i
        } else if (page < 4) {
          pageNum = i
        } else if (page > totalPages - 5) {
          pageNum = totalPages - 7 + i
        } else {
          pageNum = page - 3 + i
        }
        return (
          <button key={pageNum} onClick={() => onPageChange(pageNum)}
            className={`fd-page-num ${page === pageNum ? 'is-current' : ''}`}>
            {pageNum + 1}
          </button>
        )
      })}

      <button disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)} className="fd-page-nav">
        {t('findDoctor.next')} →
      </button>
    </div>
  )
}
