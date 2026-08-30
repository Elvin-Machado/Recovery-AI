function StatCard({ label, value, description }) {
  return (
    <div className="stat-card">
      <span className="stat-card__label">{label}</span>

      <strong className="stat-card__value">
        {value}
      </strong>

      <span className="stat-card__description">
        {description}
      </span>
    </div>
  );
}

export default StatCard;