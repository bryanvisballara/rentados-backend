function matchesShopLocation(item, { city, country }) {
  const countries = item.targetCountries || [];
  const cities = item.targetCities || [];

  if (!countries.length && !cities.length) return true;

  const normalizedCountry = country?.trim().toLowerCase();
  const normalizedCity = city?.trim().toLowerCase();

  if (countries.length) {
    const countryMatch = countries.some(
      (value) => value.trim().toLowerCase() === normalizedCountry
    );
    if (!countryMatch) return false;
  }

  if (cities.length) {
    const cityMatch = cities.some((value) => value.trim().toLowerCase() === normalizedCity);
    if (!cityMatch) return false;
  }

  return true;
}

module.exports = { matchesShopLocation };
