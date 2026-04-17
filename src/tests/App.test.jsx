import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import App from '../App'

describe('App', () => {
  test('whenProjectCardIsClickedThenOpensProjectDetailsModal', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /abrir detalhes do projeto neon street pack/i }))

    expect(screen.getByRole('heading', { level: 2, name: /neon street pack/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /fechar/i })).toBeInTheDocument()
  })

  test('whenLikeButtonIsClickedTwiceThenCountsOnlyOneLikePerSession', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /abrir detalhes do projeto neon street pack/i }))

    const likeButton = screen.getByRole('button', { name: /amei/i })

    fireEvent.click(likeButton)
    fireEvent.click(likeButton)

    expect(likeButton).toBeDisabled()
  })
})
