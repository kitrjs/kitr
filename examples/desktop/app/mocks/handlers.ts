import { HttpResponse, http } from '@kitr/mocks'

export const handlers = [
  http.get('*/me', () => HttpResponse.json({ id: 'u1', email: 'dev@example.com', role: 'admin' })),
]
