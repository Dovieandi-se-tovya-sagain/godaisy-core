// components/translation/TranslatedFishCard.tsx

import React from 'react';
import { useContextualTranslation } from '../../contexts/LanguageContext';

interface TranslatedFishNameProps {
  name: string;
  className?: string;
}

export function TranslatedFishName({ name, className = '' }: TranslatedFishNameProps) {
  const { translated } = useContextualTranslation(name);
  return <span className={className}>{translated}</span>;
}

interface TranslatedFishBioProps {
  bio: string;
  className?: string;
}

export function TranslatedFishBio({ bio, className = '' }: TranslatedFishBioProps) {
  const { translated, loading } = useContextualTranslation(bio);
  
  if (loading) {
    return <div className={`animate-pulse bg-base-300 rounded h-4 ${className}`}></div>;
  }
  
  return <p className={className}>{translated}</p>;
}

interface TranslatedTextProps {
  text: string;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}

export function TranslatedText({ text, className = '', as = 'span' }: TranslatedTextProps) {
  const { translated } = useContextualTranslation(text);
  
  // Debug logging for weather terms
  if (text && (text.includes('breeze') || text.includes('Choppy') || text.includes('Calm') || text.includes('Gale'))) {
    console.log('[TranslatedText] Weather term:', { original: text, translated, same: text === translated });
  }
  
  const Component = as;
  return <Component className={className}>{translated}</Component>;
}