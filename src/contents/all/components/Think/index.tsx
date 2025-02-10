import './index.scss';

const Think = ({ context }: { context: string }) => {
    return (
        <div className="deepseek-popup">
            <div className="deepseek-header">🧠 已深思熟虑</div>
            <p>{context}</p>
        </div>
    );
};

export default Think;
