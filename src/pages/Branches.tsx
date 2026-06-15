import { useNavigate } from 'react-router-dom';
import { BRANCHES, telLink, whatsappLink } from '../data/branches';
import { useStore } from '../store/context';

export default function Branches() {
  const { branchId, setBranch } = useStore();
  const navigate = useNavigate();

  const shopBranch = (id: string) => {
    setBranch(id);
    navigate('/shop');
  };

  return (
    <div className="container">
      <h1>Our Stores</h1>
      <p className="muted">
        Visit us in person, or message any branch on WhatsApp to check stock and reserve a phone.
        Every branch carries its own inventory — choose a branch to shop what's available there.
      </p>

      <div className="branch-grid">
        {BRANCHES.map((b) => (
          <div key={b.id} className={`branch-card ${branchId === b.id ? 'active' : ''}`}>
            <div className="branch-card-head">
              <h3>{b.city}</h3>
              {branchId === b.id && <span className="branch-tag">Your branch</span>}
            </div>
            <p className="branch-area">{b.area}</p>
            <p className="branch-address">{b.address}</p>
            {b.landmark && <p className="muted">Landmark: {b.landmark}</p>}
            <p className="branch-hours">🕑 {b.hours}</p>

            <div className="branch-actions">
              <button className="btn btn-primary btn-block" onClick={() => shopBranch(b.id)}>
                Shop this branch
              </button>
              <div className="branch-contact-row">
                <a className="btn btn-whatsapp" href={whatsappLink(b, `Hi ${b.name}, I'd like to know what phones you have in stock.`)} target="_blank" rel="noopener noreferrer">
                  💬 WhatsApp
                </a>
                <a className="btn btn-outline" href={telLink(b)}>📞 Call</a>
                <a className="btn btn-outline" href={b.mapUrl} target="_blank" rel="noopener noreferrer">🗺️ Directions</a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
