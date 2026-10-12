import { useMutation } from '@tanstack/react-query'
import { apiDownload } from './client'

export type ReportFormat = 'csv' | 'xlsx' | 'pdf'

export interface ReportParams {
  format: ReportFormat
  dateFrom: string
  dateTo: string
}

/** Downloads the report and hands it to the browser as a file. */
export function useDownloadReportMutation() {
  return useMutation({
    mutationFn: async ({ format, dateFrom, dateTo }: ReportParams) => {
      const { blob, filename } = await apiDownload(
        '/admin/reports',
        { format, date_from: dateFrom, date_to: dateTo },
        `reporte-reservas.${format}`,
      )
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    },
  })
}
