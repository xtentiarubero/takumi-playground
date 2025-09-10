type Props = {
  error: string | null;
  imgUrl: string;
};

export default function Preview({ error, imgUrl }: Props) {
  return (
    <div className="pg-preview">
      {error ? (
        <div className="pg-error">{String(error)}</div>
      ) : imgUrl ? (
        <img src={imgUrl} alt="Preview" />
      ) : (
        <div className="pg-placeholder">Render to preview</div>
      )}
    </div>
  );
}
