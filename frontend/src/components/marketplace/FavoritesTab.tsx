import React from 'react'
import type { TFunction } from 'i18next'
import { MarketplaceListing } from '../../types'
import { ListingCard } from './ListingCard'

export const FavoritesTab: React.FC<{
  favorites: MarketplaceListing[]; formatCurrency: (n: number) => string;
  onViewListing: (l: MarketplaceListing) => void; favoriteIds: Set<string>; onToggleFavorite: (id: string) => void; t: TFunction;
}> = ({ favorites, formatCurrency, onViewListing, favoriteIds, onToggleFavorite, t }) => (
  <div>
    <h3 className="mp-section-title">❤️ {t('marketplace.tabs.favorites')}</h3>
    {favorites.length === 0 ? (
      <p className="mp-empty">{t('marketplace.engagement.noFavorites')}</p>
    ) : (
      <div className="mp-grid">
        {favorites.map(l => <ListingCard key={l.id} listing={l} formatCurrency={formatCurrency}
          onView={() => onViewListing(l)}
          isFavorite={favoriteIds.has(l.id)} onToggleFavorite={() => onToggleFavorite(l.id)} t={t} />)}
      </div>
    )}
  </div>
)
