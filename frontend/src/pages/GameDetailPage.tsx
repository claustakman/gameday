import { useParams } from 'react-router-dom';

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="px-4 pt-6">
      <h2 className="text-xl font-bold text-text1 mb-4">Kampdetalje</h2>
      <p className="text-text2 text-sm">Kamp-ID: {id}</p>
    </div>
  );
}
